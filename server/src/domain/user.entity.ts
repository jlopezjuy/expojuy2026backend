import { Exclude } from 'class-transformer';
import { Column, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';

import { Authority } from './authority.entity';
import { BaseEntity } from './base/base.entity';

@Entity('jhi_user')
export class User extends BaseEntity {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column({ unique: true })
  login: string;
  @Column({ nullable: true })
  firstName?: string;
  @Column({ nullable: true })
  lastName?: string;
  @Column()
  email: string;
  @Column({ default: false })
  activated?: boolean;
  @Column({ default: 'en' })
  langKey?: string;

  @ManyToMany(() => Authority)
  @JoinTable()
  authorities?: any[];

  @Column({
    type: 'varchar',
  })
  @Exclude()
  password: string;
  @Column({ nullable: true })
  imageUrl?: string;
  @Column({ nullable: true })
  activationKey?: string;
  @Column({ nullable: true })
  resetKey?: string;
  @Column({ nullable: true })
  resetDate?: Date;
}
